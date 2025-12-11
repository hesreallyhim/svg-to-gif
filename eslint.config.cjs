const { defineConfig } = require("eslint/config");
const globals = require("globals");
const js = require("@eslint/js");
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    extends: compat.extends("eslint:recommended", "prettier"),

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.jest,
        },

        ecmaVersion: "latest",
        sourceType: "commonjs",
    },

    rules: {
        "no-unused-vars": "warn",
        "no-undef": "error",
        "no-console": "off",
        eqeqeq: "warn",
        curly: "warn",
    },
}]);
