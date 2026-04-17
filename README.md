<p align="center"><img src="./firestore-lsp-logo.png"></img></p>

# Firestore Rules LSP VSCode Extension

<p align="center"><img src="./example.gif"></img></p>

This extension in comparison to others available in the market place, utilizes a LSP ([_Language Server Provider_](https://microsoft.github.io/language-server-protocol/)) and does not rely on semantic calculations on the extension level.

Upon preparation the extension simply wraps around it, and can utilze the features that the LSP is able to provide instead of running its own calculations.
The LSP runs natively on machine (its not a node app) so that memory and cpu overhead is kept at minium.
The source code of the LSP can be found [here](https://github.com/JulindM/firestore-rules-lsp).

> Make sure the theme you are using supports semantic color tokenizations, otherwise you will not see colors. This is because the extension does not come with a textmate grammar definition that (old) themes might use for token colorization.
>
> The default VSCode theme does have this feature.

### Current features

- Syntax highlighting
- Autocomplete
- Go to definition
- Find references
- Type inference
- Linting
  - Wrong return type for `if` rules
  - Unused variable definition
  - Unused function declaration
- Method/Variable documentation
- Syntax errors
