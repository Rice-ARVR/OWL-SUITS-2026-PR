import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    { ignores: ["build/**", "node_modules/**", ".react-router/**"] },
    js.configs.recommended,
    tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,
    reactHooks.configs["recommended-latest"],
    {
        rules: {
            "react/react-in-jsx-scope": "off", // not needed with React 17+
        },
        settings: {
            react: { version: "detect" },
        },
    },
    prettier,
);
