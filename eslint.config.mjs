import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

/**
 * ESLint 9, flat config. Lo mismo que `.eslintrc.json` con `next lint`
 * (Next 16 ya no trae `next lint`): `next/core-web-vitals` y las dos reglas de
 * hooks de siempre.
 *
 * eslint-plugin-react-hooks 7 mete en su «recommended» las reglas del React
 * Compiler (set-state-in-effect, refs, immutability…). Hablan de código que el
 * compilador no sabría memoizar, y aquí no hay compilador: se dejan apagadas
 * hasta el día que se active, que será su propio encargo.
 */
export default defineConfig([
  ...nextVitals,
  globalIgnores([".next*/**", "node_modules/**", "public/**", "data/**", "supabase/**", "next-env.d.ts"]),
  {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
    },
  },
  {
    // los ficheros de configuración exportan un objeto suelto, como manda cada herramienta
    files: ["*.config.{js,mjs,ts}"],
    rules: { "import/no-anonymous-default-export": "off" },
  },
]);
