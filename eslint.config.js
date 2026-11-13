import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

/**
 * ESLint 扁平配置。
 * 目标不是「全量风格检查」（格式交给 Prettier），而是拦住真正会出问题的东西：
 * 未使用变量/导入、未定义变量、Vue 模板里的悬空引用、Hook 之外的生命周期误用。
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'docs/**', 'patches/**', '.tmp-check/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // 未使用的东西一律报错：本次重构清掉了大量此类残留，靠规则防止回潮
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'vue/no-unused-vars': 'error',
      'vue/no-unused-components': 'error',

      // 与 Prettier 冲突 / 对单人项目噪音过大的排版规则关掉
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',

      // 视图文件名就是 Map1/Demo4 这类历史命名，不强制多词组件名
      'vue/multi-word-component-names': 'off',
    },
  },
]
