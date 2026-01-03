# deslop

CLI tool for removing AI slop from codebases.

## Quick Start

```bash
npx deslop@latest
```

## Commands

- `npx deslop@latest` - Analyze current directory
- `npx deslop@latest -d <path>` - Analyze specific directory
- `npx deslop@latest init` - Create project `deslop.toml` config
- `npx deslop@latest config` - Edit global config (`~/.deslop/config.toml`)
- `npx deslop@latest logout` - Remove stored API key

## Configuration

Set `CURSOR_API_KEY` environment variable, or deslop will prompt on first run and store it securely.

## Development

```bash
npm install && npm run build && npm start
```

## License

MIT - see [LICENSE](LICENSE)
