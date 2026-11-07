"""StickSolid: turn a script line into words a TTS engine reads correctly (English).

Kokoro (espeak underneath) misreads numbers, years, times, money, units and abbreviations.
normalizza(line) rewrites them as spoken words before the voice is made; the captions keep the
original text. Run it alone to see every rule on the test lines:  python normalizza.py
"""
import re

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth", "twelve": "twelfth"}
MONTHS = "January February March April May June July August September October November December".split()
MON_ABBR = {m[:3]: m for m in MONTHS} | {"Sept": "September"}


def words(n):
    """integer -> English words (up to the trillions)"""
    n = int(n)
    if n < 0: return "minus " + words(-n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("-" + ONES[n % 10] if n % 10 else "")
    if n < 1000: return ONES[n // 100] + " hundred" + (" " + words(n % 100) if n % 100 else "")
    for size, name in ((10 ** 12, "trillion"), (10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= size:
            return words(n // size) + " " + name + (" " + words(n % size) if n % size else "")


def ordinal(n):
    w = words(n)
    head, _, last = w.rpartition("-") if "-" in w.split(" ")[-1] else w.rpartition(" ")
    sep = "-" if "-" in w.split(" ")[-1] else " "
    if last in ORD: last = ORD[last]
    elif last.endswith("y"): last = last[:-1] + "ieth"
    else: last += "th"
    return (head + sep if head else "") + last


def year(n):
    """1780 -> seventeen eighty, 1905 -> nineteen oh five, 2007 -> two thousand seven, 2026 -> twenty twenty-six"""
    n = int(n)
    if 2000 <= n < 2010: return "two thousand" + (" " + words(n % 100) if n % 100 else "")
    hi, lo = divmod(n, 100)
    if lo == 0: return words(hi) + " hundred"
    return words(hi) + " " + (("oh " + ONES[lo]) if lo < 10 else words(lo))


def decimal(s):
    whole, _, frac = s.partition(".")
    return words(int(whole or 0)) + " point " + " ".join(ONES[int(d)] for d in frac)


def number(s):
    s = s.replace(",", "")
    return decimal(s) if "." in s else words(int(s))


UNITS = {  # after a number
    "km/h": "kilometers per hour", "kph": "kilometers per hour", "mph": "miles per hour", "m/s": "meters per second",
    "km": "kilometers", "m": "meters", "cm": "centimeters", "mm": "millimeters", "mi": "miles", "ft": "feet",
    "kg": "kilograms", "g": "grams", "lb": "pounds", "lbs": "pounds", "t": "tons", "l": "liters", "L": "liters", "ml": "milliliters",
    "s": "seconds", "sec": "seconds", "secs": "seconds", "min": "minutes", "mins": "minutes", "h": "hours", "hr": "hours", "hrs": "hours",
    "°C": "degrees Celsius", "°F": "degrees Fahrenheit", "°": "degrees", "%": "percent", "x": "times",
}
ABBR = {
    r"\bDr\.": "Doctor", r"\bMr\.": "Mister", r"\bMrs\.": "Missus", r"\bMs\.": "Miz", r"\bProf\.": "Professor", r"\bSt\.(?= [A-Z])": "Saint",
    r"\bMt\.": "Mount", r"\bvs\.?": "versus", r"\be\.g\.": "for example", r"\bi\.e\.": "that is", r"\betc\.": "et cetera",
    r"\bapprox\.": "about", r"\bNo\.(?= ?\d)": "number", r"\bWWII\b": "World War Two", r"\bWWI\b": "World War One", r"\bWW2\b": "World War Two",
    r"\bU\.S\.A?\.?": "U S", r"\bU\.K\.": "U K", r"\bUSA\b": "U S A", r"\bUK\b": "U K", r"\bUS\b(?= [a-z])": "U S",
}
SPELL = ["FBI", "CIA", "CEO", "DNA", "TV", "UFO", "CCTV", "GPS", "ATM", "SOS", "BBC", "CNN", "KGB", "USSR", "EU", "UN", "AI"]
WORDS_AS_IS = ["NASA", "NATO", "UNESCO", "OK", "AM", "PM"]


NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"   # 1,670 / 9.58 / 41, never eating a trailing comma or full stop
INT = r"\d{1,3}(?:,\d{3})+|\d+"


def normalizza(t):
    t = t.replace("…", ", ").replace("...", ", ").replace("—", ", ").replace("–", ", ")
    t = re.sub(r"\s*[\U0001F000-\U0001FFFF☀-➿]+", "", t)                                 # emoji
    t = t.replace("&", " and ").replace("“", "").replace("”", "").replace("‘", "'").replace("’", "'")
    for pat, rep in ABBR.items(): t = re.sub(pat, rep, t)
    for m in MON_ABBR: t = re.sub(rf"\b{m}\.", MON_ABBR[m], t)
    # money: $3.5 million, $10,000, $20
    t = re.sub(rf"\$({NUM})\s*(million|billion|trillion|thousand)\b", lambda m: f"{number(m[1])} {m[2]} dollars", t)
    t = re.sub(rf"\$({INT})\.(\d\d)\b", lambda m: f"{number(m[1])} dollars and {words(m[2])} cents", t)
    t = re.sub(rf"\$({INT})", lambda m: f"{number(m[1])} dollar" + ("" if m[1] == "1" else "s"), t)
    t = re.sub(rf"({NUM})\s*(million|billion|trillion)\b", lambda m: f"{number(m[1])} {m[2]}", t)
    # times: 2:07 am, 11:52 AM, 3:00
    def clock(m):
        h, mi, ap = int(m[1]), int(m[2]), (m[3] or "").replace(".", "").lower()
        w = words(h) + (" o'clock" if mi == 0 and not ap else "" if mi == 0 else " oh " + ONES[mi] if mi < 10 else " " + words(mi))
        return w + (" A M" if ap == "am" else " P M" if ap == "pm" else "")
    t = re.sub(r"\b(\d{1,2}):(\d\d)\s*([aApP]\.?[mM]\.?)?(?![\w])", clock, t)
    # dates: May 19, 1780 / May 19th / 19 May 1780
    t = re.sub(rf"\b({'|'.join(MONTHS)}) (\d{{1,2}})(?:st|nd|rd|th)?\b", lambda m: f"{m[1]} {ordinal(m[2])}", t)
    t = re.sub(rf"\b(\d{{1,2}})(?:st|nd|rd|th)? ({'|'.join(MONTHS)})\b", lambda m: f"the {ordinal(m[1])} of {m[2]}", t)
    # decades: 1990s, '80s
    t = re.sub(r"\b(1[0-9]|20)(\d)0s\b", lambda m: year(int(m[1] + m[2] + "0")).replace("ty", "ties") if m[2] != "0" else year(int(m[1] + "00")) + "s", t)
    t = re.sub(r"'([2-9])0s\b", lambda m: TENS[int(m[1])][:-1] + "ies", t)
    # years: a 4-digit number 1100-2099 that is not a quantity (no comma, not followed by a unit or plural noun)
    t = re.sub(r"(?<![\d,.$#])\b(1[1-9]\d\d|20\d\d)\b(?!\d|[,.]\d|\s*(?:%|km|kg|m\b|meters|metres|kilomet|kilogram|miles|mph|kph|degrees|pounds|euros|people|feet|dollars|years|times|lbs|tons))", lambda m: year(m[1]), t)
    # ordinals: 23rd, 1st, 21st
    t = re.sub(r"\b(\d+)(st|nd|rd|th)\b", lambda m: ordinal(m[1]), t)
    # numbers with units: 1,670 km/h, -40°C, 9.58 s, 41%
    units = "|".join(sorted((re.escape(u) for u in UNITS), key=len, reverse=True))
    def unit(m):
        n = m[1]; u = UNITS[m[2]]
        if n.replace(",", "") in ("1", "-1") and u.endswith("s") and u not in ("degrees Celsius", "degrees Fahrenheit"): u = u[:-1]
        return number(n) + " " + u if not n.startswith("-") else "minus " + number(n[1:]) + " " + u
    t = re.sub(r"\b(\d+) in (\d+)\b", lambda m: f"{words(m[1])} in {words(m[2])}", t)
    t = re.sub(rf"(-?(?:{NUM}))\s?({units})(?![A-Za-z])", unit, t)
    t = re.sub(r"#\s?(\d+)", lambda m: "number " + words(m[1]), t)
    t = re.sub(r"(?<![\w])-(\d)", r"minus \1", t)
    t = re.sub(NUM, lambda m: number(m[0]), t)                                                      # any number left
    for a in SPELL: t = re.sub(rf"\b{a}\b", " ".join(a), t)
    t = re.sub(r"\s+([,.!?;:])", r"\1", t); t = re.sub(r"\s{2,}", " ", t)
    return t.strip()


TEST = [
    "At the equator, the ground moves at about 1,670 kilometers an hour.",
    "It happened on May 19, 1780.",
    "It's 2:07 am, and your phone is at 41%.",
    "Dr. Smith flew from the U.S. to the U.K. in 1945.",
    "You just found $3.5 million in a gym bag, plus $20.",
    "The temperature dropped to -40°C.",
    "The FBI and NASA tracked Flight 19 for 5 hrs.",
    "Part 2 comes out on Nov. 8th, in the 2nd week.",
    "He ran 100 m in 9.58 s, faster than 99.9% of people.",
    "From the 23rd floor, 1 in 3 people live alone.",
    "WWII ended in 1945, and the Titanic sank in 1912.",
    "St. Louis, Mt. Everest, vs. the Moon.",
    "It weighs 22 lbs, about 10 kg.",
    "The 1990s, the '80s, and the year 2007.",
    "Type GO or STAY in the comments! Strange Days #3.",
    "In 1872, the Mary Celeste was found adrift, and 10,000 people read the news.",
]

if __name__ == "__main__":
    for s in TEST: print(s, "\n   ->", normalizza(s))
