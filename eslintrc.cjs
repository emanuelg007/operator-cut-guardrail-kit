module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "filenames", "unicorn"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "import/no-default-export": "error",
    "filenames/match-regex": ["error", "^[a-z0-9]+(?:-[a-z0-9]+)*$", true],
  },
};
  
