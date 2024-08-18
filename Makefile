build-AuthorizerFunction:
	pnpm install
	pnpm build
	cp -r dist/authorizer "$(ARTIFACTS_DIR)"
build-ApiFunction:
	pnpm install
	pnpm build
	cp -r dist/api "$(ARTIFACTS_DIR)"