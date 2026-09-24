module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#14233b",
        brand: { 50: "#eff6ff", 100: "#dbeafe", 600: "#2563eb", 700: "#1d4ed8" },
        accent: { 50: "#fff7ed", 100: "#ffedd5", 500: "#f97316", 700: "#c2410c" },
        canvas: "#f5f7fb",
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 24px 70px -36px rgba(15, 35, 65, 0.55)",
        card: "0 12px 32px -22px rgba(20, 35, 59, 0.30)",
        "card-hover": "0 22px 44px -24px rgba(20, 35, 59, 0.32)",
      },
    },
  },
  plugins: [],
};
