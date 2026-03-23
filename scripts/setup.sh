#!/bin/bash
# Development Setup Script
# Run this to set up local development environment

set -e

echo "🚀 Elite Paint Voucher - Development Setup"
echo "==========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install wrangler globally
echo ""
echo "🔧 Installing Wrangler..."
npm install -g wrangler

# Create .env.local if not exists
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your configuration"
fi

# Create .wrangler if not exists
if [ ! -d .wrangler ]; then
    echo ""
    echo "📁 Creating .wrangler directory..."
    mkdir -p .wrangler
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.local with your Google OAuth credentials"
echo "2. Run: wrangler login"
echo "3. Create D1 database: wrangler d1 create elite-voucher"
echo "4. Start development: npm run dev"
echo ""
echo "🎉 Ready to start developing!"
