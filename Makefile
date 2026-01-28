.PHONY: help

MAX_TARGET_LEN := $$(grep -E -h '\s\#\#\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS=":.*?\#\# "}; {print length($$1)}' | sort -n | tail -n1)
CYAN := "\\033[36m"
BLACK := "\\033[0m"

help: ## ❓ Help message
	@printf "\n"
	@printf "👷 Development\n"
	@printf "%s\n" "---------------------"
	@printf "\n"
	@printf "It is recommended to run development process inside 🐳 docker nodejs container.\n"
	@printf "In the $(CYAN)docker-compose.yaml$(BLACK) you could see two services:\n"
	@printf "\n"
	@printf " * $(CYAN)app$(BLACK): which is nodejs container for development;\n"
	@printf " * $(CYAN)dns$(BLACK): which is dns server crafted for lookup controller behaviour testing.\n"
	@printf "\n"
	@printf "Run $(CYAN)make develop$(BLACK) to start both $(CYAN)app$(BLACK) and $(CYAN)dns$(BLACK) containers.\n"
	@printf "You will be attached to $(CYAN)app$(BLACK) container where you will able to run tests\n"
	@printf "using npm scripts, like $(CYAN)npm test$(BLACK) or $(CYAN)npm run test:code$(BLACK) and so on.\n"
	@printf "Docker container will be removed right after you leave $(CYAN)app$(BLACK) container.\n"
	@printf "\n"
	@printf "Run $(CYAN)make test$(BLACK) to perform full all available tests.\n"
	@printf "\n"
	@printf "Run $(CYAN)make clean$(BLACK) to remove stale docker containers, npm cache and dependencies.\n"
	@printf "\n"
	@printf "Commands available through $(CYAN)make$(BLACK):\n"
	@printf "\n"
	@grep -E -h '\s##\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS=":.*?## "}; {printf "'$(CYAN)'make %-'$(MAX_TARGET_LEN)'s'$(BLACK)' %s\n", $$1, $$2}'
	@printf "\n"

develop: docker_run_install docker_run_sh docker_containers_clean ## 👷 Start development environment

attach: docker_exec_sh ## 👷 Attach to running app container

test: docker_run_install docker_run_test docker_containers_clean ## 🧪 Run tests with all preparations and cleanups

clean: docker_containers_clean modules_clean docker_images_clean ## 🧹 Remove all docker containers and images, npm cache and dependencies

docker_containers_clean: ## 🧹 Stop and remove all containers and related resources
	@docker compose down --remove-orphans --volumes
	@docker compose rm --force --stop -v

docker_images_clean: ## 🧹 Remove docker images
	@-docker compose config --images | uniq | xargs docker image rm

docker_run_install: ## 📦 Install npm dependencies
	@-docker compose run --pull=missing --no-deps --rm app npm ci

docker_run_test: ## 🧪 Run tests in the app container
	@-docker compose run --pull=missing --rm app npm test

docker_run_sh: ## 👷 Run app container for development purpose
	@if [ -z "$$(docker compose ps -q --filter status=running app | head -n1)" ]; then \
		docker compose run --pull=missing --rm --service-ports app zsh; \
		`# Exit code always 0 to avoid cancelling cleanup execution` exit 0; \
	else \
		printf "\n"; \
		printf "💥 Container app is running already, it is attached to another terminal session.\n"; \
		printf "ℹ️  Please, do $(CYAN)make attach$(BLACK) to attach to the running container.\n"; \
		printf "   Do $(CYAN)make docker_clean$(BLACK) to remove all running containers.\n"; \
		printf "   Or $(CYAN)make clean$(BLACK) to remove even more.\n"; \
		printf "   See more options with $(CYAN)make help$(BLACK).\n"; \
		printf "\n"; \
		exit 1; \
	fi

docker_exec_sh: ## 👷 Attach to running app container
	@if [ ! -z "$$(docker compose ps -q --filter status=running app | head -n1)" ]; then \
		docker exec -it $$(docker compose ps -q --filter status=running | head -n1) zsh; \
	else \
		printf "\n" \
		printf "💥 Container app is not running yet.\n"; \
		printf "ℹ️ Please do $(CYAN)make develop$(BLACK) to start app container\n" \
		printf "\n" \
		exit 1; \
	fi

modules_clean: ## 🧹 Remove all npm cache from 📁 .npm/ and dependencies from 📁 node_modules/
	@-docker compose run --pull=missing --rm app npm run clean
	@rm -rf node_modules/
