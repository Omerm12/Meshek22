/**
 * Loads environment variables from .env.local (preferred) then .env (fallback).
 * Must be imported before any process.env reads in Node/tsx scripts.
 *
 * Uses `override: false` so variables already set in the shell are never clobbered.
 */
import * as dotenv from "dotenv";
import path from "path";

const root = path.resolve(process.cwd());

// .env.local first — values already in process.env win (override: false)
dotenv.config({ path: path.join(root, ".env.local"), override: false });
// .env as fallback for anything not yet defined
dotenv.config({ path: path.join(root, ".env"),       override: false });
