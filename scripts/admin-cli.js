#!/usr/bin/env node

/**
 * Admin CLI Tool
 * Manage Elite Paint Voucher system from command line
 */

const { Database } = require('../shared/db.js');

class AdminCLI {
  constructor() {
    this.commands = {
      'create-admin': this.createAdmin,
      'list-users': this.listUsers,
      'block-user': this.blockUser,
      'extend-trial': this.extendTrial,
      'export-data': this.exportData,
      'help': this.showHelp
    };
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const command = args[0];
    const params = args.slice(1);

    if (this.commands[command]) {
      try {
        await this.commands[command](params);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    } else {
      console.error(`Unknown command: ${command}`);
      this.showHelp();
      process.exit(1);
    }
  }

  createAdmin(params) {
    console.log('Creating admin user...');
    console.log('This command requires database access via wrangler');
    console.log('Usage: npm run admin -- create-admin <email> <name>');
  }

  listUsers(params) {
    console.log('Listing users...');
    console.log('Usage: npm run admin -- list-users [limit]');
  }

  blockUser(params) {
    console.log('Blocking user...');
    if (params.length === 0) {
      console.log('Usage: npm run admin -- block-user <user-id>');
      return;
    }
    console.log(`Blocking user: ${params[0]}`);
  }

  extendTrial(params) {
    console.log('Extending trial...');
    if (params.length < 2) {
      console.log('Usage: npm run admin -- extend-trial <user-id> <days>');
      return;
    }
    console.log(`Extending trial for user ${params[0]} by ${params[1]} days`);
  }

  exportData(params) {
    console.log('Exporting data...');
    console.log('Usage: npm run admin -- export-data [type]');
    console.log('Types: users, vouchers, all');
  }

  showHelp() {
    console.log(`
Elite Paint Voucher Admin CLI

Commands:
  create-admin <email> <name>      Create new admin user
  list-users [limit]               List all users
  block-user <user-id>             Block a user
  extend-trial <user-id> <days>    Extend user trial
  export-data [type]               Export database
  help                             Show this help

Usage:
  npm run admin -- <command> [params]

Examples:
  npm run admin -- list-users 20
  npm run admin -- extend-trial user_123 30
  npm run admin -- export-data vouchers
    `)
  }
}

// Run CLI
const cli = new AdminCLI();
cli.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
