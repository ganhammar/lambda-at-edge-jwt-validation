build-AuthorizerFunction:
	pnpm install
	pnpm build
	cp -r dist "$(ARTIFACTS_DIR)/"