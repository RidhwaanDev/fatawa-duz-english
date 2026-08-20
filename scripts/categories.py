#!/usr/bin/env python3
"""Maps the collection's Arabic chapter / Urdu section headings to a clean
English category taxonomy used by the web app's filters."""

# Exact chapter title -> (english name, slug)
CHAPTER_MAP = {
    "كتاب الإيمان والعقائد": ("Faith & Belief", "faith"),
    "كتاب الطهارة": ("Purification", "purification"),
    "كتاب الصلاة": ("Prayer", "prayer"),
    "كتاب الزكاة": ("Zakat", "zakat"),
    "كتاب الصوم": ("Fasting", "fasting"),
    "ابواب الصوم سے متعلق متفرق مسائل:": ("Fasting", "fasting"),
    "كتاب الحج": ("Hajj & Umrah", "hajj"),
    "كتاب النكاح": ("Marriage", "marriage"),
    "كتاب الطلاق": ("Divorce", "divorce"),
    "كتاب البيوع": ("Trade & Business", "trade"),
    "كتاب الإجارة": ("Hire & Employment", "hire"),
    "كتاب المضاربة": ("Partnership & Investment", "partnership"),
    "كتاب الوقف": ("Endowments (Waqf)", "waqf"),
    "كتاب الفرائض": ("Inheritance", "inheritance"),
    "كتاب الهبة": ("Gifts", "gifts"),
    "كتاب الوكالة": ("Agency", "agency"),
    "كتاب الشفعة": ("Pre-emption (Shufʿah)", "shufah"),
    "كتاب الأيمان والنذور": ("Oaths & Vows", "oaths"),
    "كتاب الصيد والذبائح": ("Hunting & Slaughter", "slaughter"),
    "كتاب الحدود والقصاص": ("Crime & Punishment", "hudud"),
    "كتاب الحظر والإباحة": ("Lawful & Unlawful", "lawful"),
    "كتاب الحديث والآثار": ("Hadith", "hadith"),
    "كتاب التفسير والتجويد": ("Qur'an & Tajwid", "quran"),
    "كتاب السلوك والطريقة": ("Spirituality (Tasawwuf)", "tasawwuf"),
    "زكوة، صوم، حج اور نكاح سے متعلق متفرق مسائل:": ("Miscellaneous", "misc"),
    "أصول کے متفرق مسائل": ("Miscellaneous", "misc"),
}

# For chapters titled "Uncategorized" the section heading carries the topic.
SECTION_MAP = {
    "باب (۱۹): احکام الجنائز": ("Funerals", "funerals"),
    "گروی رکھنے کے احکام کا بیان": ("Property & Liability", "property"),
    "غصب کے احکام کا بیان": ("Property & Liability", "property"),
    "احکامِ لقطہ کا بیان": ("Property & Liability", "property"),
    "مزارعت اور مساقات کے احکام کا بیان": ("Property & Liability", "property"),
    "باب (٤): احکام اللباس": ("Dress & Appearance", "dress"),
    "باب (۵): ما يتعلق بأحکام الشعور والختان والخضاب و تقلیم الأظفار":
        ("Dress & Appearance", "dress"),
    "باب (٦): سلام، تقبیل، مصافحہ اور معانقہ کے احکام": ("Manners & Etiquette", "manners"),
    "باب (۷): نام اور القاب سے متعلق احکام کا بیان": ("Names & Titles", "names"),
    "باب (۸): ما يتعلق بأحكام الألعاب و اللهو واللعب": ("Leisure & Games", "leisure"),
    "باب (۹): ما يتعلق بالقرآن الكريم و الذكر و التلاوة و الأشياء المقدسة":
        ("Qur'an & Tajwid", "quran"),
    "باب (۱)ــــ: عملیات اور سحر سے متعلق احکام کا بیان": ("Amulets & Occult", "occult"),
    "باب (۱۱): حیوانات سے متعلق احکام کا بیان": ("Animals", "animals"),
    "باب (۱۲): امورِ سیاست اور قضا سے متعلق احکام کا بیان": ("Politics & Judiciary", "politics"),
    "باب (۱۳): حظر و اباحت سے متعلق متفرق مسائل کا بیان": ("Lawful & Unlawful", "lawful"),
    "باب… )۱( طہارت سے متعلق متفرق مسائل": ("Purification", "purification"),
    "باب… )۲( نماز سے متعلق متفرق مسائل": ("Prayer", "prayer"),
    "باب… )۸( نکاح و طلاق سے متعلق متفرق مسائل": ("Marriage", "marriage"),
    "باب… )۹( وقف سے متعلق متفرق مسائل:": ("Endowments (Waqf)", "waqf"),
    "باب… )۱۰( تجارت سے متعلق متفرق مسائل کا بیان": ("Trade & Business", "trade"),
}

# Display order for the category rail.
ORDER = [
    "faith", "purification", "prayer", "funerals", "zakat", "fasting", "hajj",
    "marriage", "divorce", "inheritance", "trade", "hire", "partnership",
    "property", "gifts", "agency", "shufah", "waqf", "oaths", "slaughter",
    "animals", "dress", "manners", "names", "leisure", "lawful", "hudud",
    "politics", "quran", "hadith", "tasawwuf", "occult", "misc",
]


def classify(chapter, section):
    hit = CHAPTER_MAP.get((chapter or "").strip())
    if hit:
        return hit
    hit = SECTION_MAP.get((section or "").strip())
    if hit:
        return hit
    return ("Miscellaneous", "misc")
