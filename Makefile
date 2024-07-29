build-AuthorizerFunction:
	pnpm install
	pnpm build
	cp -r dist/authorizer "$(ARTIFACTS_DIR)/authorizer"
build-ApiFunction:
	pnpm install
	pnpm build
	cp -r dist/api "$(ARTIFACTS_DIR)/api"