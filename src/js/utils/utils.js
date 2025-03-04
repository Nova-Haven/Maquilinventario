export function formatNumber(num) {
  if (num === undefined || num === null) return "0";
  return num.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function handleError(error, message = "Error al cargar los datos") {
  console.error("Error:", error);
  const loadingMessage = document.getElementById("loadingMessage");
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

export function formatDate(date) {
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const day = date.getDate().toString().padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

export function toTitleCase(str) {
  // Special cases for Mexican company suffixes
  const specialCases = {
    "sa de cv": "SA de CV",
    "sapi de cv": "SAPI de CV",
    "srl de cv": "SRL de CV",
    "s de rl": "S de RL",
    "s de rl de cv": "S de RL de CV",
    "sc de rl": "SC de RL",
  };

  // Words to keep lowercase (prepositions and articles)
  const lowercaseWords = [
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "y",
    "e",
    "o",
    "u",
  ];

  // First convert the string to lowercase
  const lowerStr = str.toLowerCase();

  // Check for company suffix at the end of the string
  for (const [suffix, replacement] of Object.entries(specialCases)) {
    if (lowerStr.endsWith(` ${suffix}`)) {
      // Split the string to separate the company name and suffix
      const mainPart = str.slice(0, -suffix.length).trim();
      // Title case the main part while keeping certain words lowercase
      const titleCased = mainPart
        .toLowerCase()
        .split(" ")
        .map((word, index) => {
          // Always capitalize first word
          if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
          // Keep certain words lowercase
          if (lowercaseWords.includes(word)) return word;
          // Capitalize other words
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");

      return `${titleCased} ${replacement}`;
    }
  }

  // If no special suffix found, apply the same title case rules
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (lowercaseWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
