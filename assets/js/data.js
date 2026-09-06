/* PhoenixYing — app catalogue data.
   Add a new app by appending one record; drop the icon into assets/icons/. */

var APPS = [
  {
    id: "iching-life-guide",
    name: "I Ching: Yi Jing Life Guide",
    tagline: "AI interpretations of the 64 hexagrams, grounded in the original classics",
    description: "Cast hexagrams, read the classics, and explore 4,096 transformations with AI-guided readings rooted in the source texts. A learning and thinking tool for the Book of Changes — rated 4.7 on the App Store.",
    category: "Reference",
    platform: "iOS",
    website: "https://phonixying.github.io/IChingLifeGuid/",
    store: "https://apps.apple.com/app/id6754808329",
    storeState: "live",
    icon: "assets/icons/iching-life-guide.png",
    featured: true
  },
  {
    id: "ancient-read",
    name: "Ancient Read",
    tagline: "High-fidelity classics reader with the feel of a traditional thread-bound book",
    description: "Page through Song- and Ming-dynasty woodblock editions of Confucian, Daoist and Buddhist classics. Zoomable high-res pages, offline downloads, and narration — an immersive window into 300+ ancient works.",
    category: "Books",
    platform: "iOS",
    website: "https://phonixying.github.io/AncientRead/",
    store: "https://apps.apple.com/app/id1453279380",
    storeState: "live",
    icon: "assets/icons/ancient-read.png",
    featured: true
  },
  {
    id: "stephealth",
    name: "StepHealth",
    tagline: "Every step counts — and deserves to be seen",
    description: "Turn Apple Health activity into a clear, warm daily record. Today's overview, weekly and monthly trends, gentle goal-setting, and fun comparisons — private, no account, no ads.",
    category: "Health & Fitness",
    platform: "iOS",
    website: "https://phonixying.github.io/StepHealth/",
    store: "https://apps.apple.com/app/stephealth-step-counter/id6798724026",
    storeState: "live",
    icon: "assets/icons/stephealth.png",
    featured: true
  },
  {
    id: "petloss",
    name: "PetLoss",
    tagline: "A gentle grief companion for pet parents",
    description: "Write letters to your companion, craft memorial cards and cinematic films, and relive memories on a timeline — with soft reminders on the hard days. Everything stays on-device, private and offline.",
    category: "Lifestyle",
    platform: "iOS",
    website: "https://phonixying.github.io/PetLoss/",
    store: "https://apps.apple.com/app/id6757967412",
    storeState: "live",
    icon: "assets/icons/petloss.png"
  },
  {
    id: "field-report-pro",
    name: "Field Report Pro",
    tagline: "Turn jobsite photos into client-ready PDF reports",
    description: "Built for contractors and inspectors. Capture issues, add notes and photos, and export professional PDF reports on the go — no account, no subscription, fully offline.",
    category: "Productivity",
    platform: "iOS",
    website: "https://phonixying.github.io/FieldReportPro/",
    store: "https://apps.apple.com/app/id6768351045",
    storeState: "live",
    icon: "assets/icons/field-report-pro.png"
  },
  {
    id: "warranty-keeper",
    name: "Warranty Keeper",
    tagline: "Never miss a warranty or return deadline again",
    description: "Snap a receipt, track serial numbers, and get reminders 30, 7 and 1 day before it matters. Local-first storage keeps your purchase history private — with OCR auto-fill to make logging effortless.",
    category: "Productivity",
    platform: "iOS",
    website: "https://phonixying.github.io/WarrantyKeeper/",
    store: "https://apps.apple.com/app/id6759252611",
    storeState: "live",
    icon: "assets/icons/warranty-keeper.png"
  },
  {
    id: "aqua-log",
    name: "AquaLog",
    tagline: "Aquarium care made simple — testing, maintenance and reminders",
    description: "Log water chemistry, feeding and filter care for your tank, completely offline and without an account. One unlock adds multi-tank support, trend charts and CSV export.",
    category: "Utilities",
    platform: "iOS",
    website: "https://phonixying.github.io/AquaLog/",
    store: "https://apps.apple.com/app/id6758230854",
    storeState: "live",
    icon: "assets/icons/aqualog.png"
  },
  {
    id: "opera-puzzle",
    name: "Opera Puzzle",
    tagline: "An immersive opera-mask jigsaw journey through the Three Kingdoms",
    description: "Step into the world of Peking-opera masks. Solve chapter-based jigsaw puzzles, collect character portraits, and unlock achievements — all playable offline.",
    category: "Games",
    platform: "iOS",
    website: "https://phonixying.github.io/Operapuzzle/",
    store: "https://apps.apple.com/app/id6758448822",
    storeState: "live",
    icon: "assets/icons/opera-puzzle.png"
  },
  {
    id: "rainbow-bible",
    name: "Rainbow Bible",
    tagline: "God's promises and your daily devotion, side by side",
    description: "A customizable KJV reading experience with themed home & lock-screen widgets and one-tap verse sharing. Immerse yourself, save what inspires you, and let scripture stay close all day.",
    category: "Reference",
    platform: "iOS",
    website: "https://phonixying.github.io/RainbowBilble/",
    store: "https://apps.apple.com/app/id6756217525",
    storeState: "live",
    icon: "assets/icons/rainbow-bible.png"
  },
  {
    id: "erp-coach",
    name: "ERP Coach",
    tagline: "Gentle ERP practice and self-support, step by step",
    description: "Graded exposure-and-response-prevention exercises for OCD and anxiety, with quick SUDS tracking and trend insights. All data stays local — no account required.",
    category: "Health",
    platform: "iOS",
    website: "https://phonixying.github.io/ERPCoach/",
    store: "https://apps.apple.com/app/id1483884068",
    storeState: "live",
    icon: "assets/icons/erp-coach.png"
  },
  {
    id: "character-assembly",
    name: "Character Assembly",
    tagline: "Learn Chinese by putting every stroke and idiom back in place",
    description: "Stroke-order challenges, idiom puzzles and classical-text rebuilding — 50 levels, 500 characters and 200 idioms. A calm, puzzle-first way to learn Hanzi on iPhone and iPad.",
    category: "Education",
    platform: "iOS",
    website: "https://phonixying.github.io/CharacterAssembly/",
    store: "https://apps.apple.com/app/fun-hanzi/id6804096171",
    storeState: "live",
    icon: "assets/icons/character-assembly.png"
  },
  {
    id: "pixel-drop",
    name: "PixelDrop",
    tagline: "A 100% local batch image exporter for macOS",
    description: "Resize, convert, rename and watermark hundreds of product photos in one pass — JPEG, PNG and HEIC with full control over quality, naming and output. No cloud uploads, no account.",
    category: "Design Tools",
    platform: "Mac",
    website: "https://phonixying.github.io/PixelDrop/",
    store: "https://apps.apple.com/app/pixeldrop-batch-image-exporter/id6797877233",
    storeState: "live",
    icon: "assets/icons/pixeldrop.png"
  },
  {
    id: "nightfall-trials",
    name: "Nightfall Trials",
    tagline: "A sharp little platformer about traps, lies and purple portals",
    description: "Five hand-built levels of vanishing ground, lying signs and swinging gears. Instant retries, zero ads, zero in-app purchases — every death makes you smarter.",
    category: "Games",
    platform: "Mac",
    website: "https://phonixying.github.io/NightfallTrials/",
    store: null,
    storeState: "coming",
    icon: "assets/icons/nightfall-trials.svg"
  }
];
