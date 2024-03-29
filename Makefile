# -----------------------------------------------------------------------------
# Codam Coding College, Amsterdam @ 2022.
# See README in the root project for more information.
# -----------------------------------------------------------------------------

# Makefile for ease of use of docker compose up and down.

up:
	@echo Docker: $@
	@docker compose up -d --build --remove-orphans

down:
	@echo Docker: $@
	@docker compose down

.DEFAULT_GOAL := up
.PHONY: up down
