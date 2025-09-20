# SkySentry Go Server Makefile

.PHONY: build run dev clean deps test

# Default target
all: build

# Install dependencies
deps:
	go mod tidy
	go mod download

# Build the server
build: deps
	go build -o bin/skysentry-server main.go

# Run the server in development mode with auto-reload (requires air)
dev:
	@if command -v air >/dev/null 2>&1; then \
		air; \
	else \
		echo "Installing air for hot reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# Run the built server
run: build
	./bin/skysentry-server

# Run directly without building
start:
	go run main.go

# Clean build artifacts
clean:
	rm -rf bin/

# Test the server
test:
	go test -v ./...

# Format code
fmt:
	go fmt ./...

# Install air for hot reload (optional)
install-air:
	go install github.com/cosmtrek/air@latest

# Docker build (if needed later)
docker-build:
	docker build -t skysentry-go .

# Quick development server (default)
.DEFAULT_GOAL := start