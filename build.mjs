// Usage: node build.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';

const env = parseEnv();
const manifestFile = JSON.parse(fs.readFileSync('./module.json', 'utf-8'));

const { id, title, version, manifest, compatibility, notes } = manifestFile;
const newVersion = bumpVersion(version);

function parseEnv() {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const envPath = path.resolve(__dirname, '.env');
	const envExamplePath = path.resolve(__dirname, '.env.example');

	if (!fs.existsSync(envPath)) {
		fs.copyFileSync(envExamplePath, envPath);
		console.log('Created .env file');
	}

	const env = {};
	const envFileContent = fs.readFileSync(envPath, 'utf-8');
	envFileContent.split('\n').forEach((line) => {
		let [key, value] = line.split('=');
		if (key && value) {
			value = value.trim();
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			}
			env[key.trim()] = value.trim();
		}
	});

	if (Object.keys(env).length === 0) {
		console.error('No .env file found or it is empty');
		process.exit(1);
	}

	return env;
}

function bumpVersion(version) {
	const arr = version.split('.');
	arr[arr.length - 1] = parseInt(arr[arr.length - 1]) + 1;
	return arr.join('.');
}

function updateVersionInManifest() {
	manifestFile.version = newVersion;
	fs.writeFileSync('./module.json', JSON.stringify(manifestFile, null, 2));
}

function updateFoundryRelease(dryRun = true) {
	const parameters = {
		id,
		release: {
			version: newVersion,
			manifest,
			notes,
			compatibility,
		},
	};
	if (dryRun) {
		parameters['dry-run'] = true;
	}
	return fetch('https://api.foundryvtt.com/_api/packages/release_version/', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: env.FOUNDRY_PACKAGE_API_KEY,
		},
		method: 'POST',
		body: JSON.stringify(parameters),
	});
}

function execCommandAsPromise(command) {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			if (stderr) {
				reject(stderr);
				return;
			}
			resolve(stdout);
		});
	});
}

console.log(`Building ${title} \x1b[31mv${version}\x1b[0m -> \x1b[32mv${newVersion}\x1b[0m`);

const attemptResponse = await updateFoundryRelease(true);
if (!attemptResponse.ok) {
	console.error('Failed to update Foundry release');
	console.error(await attemptResponse.text());
	process.exit(1);
}

updateVersionInManifest();
console.log('Updated manifest version');

try {
	await execCommandAsPromise('git add module.json');
	console.log('Added module.json to git');
	await execCommandAsPromise(`git commit -m "New release v${newVersion}"`);
	console.log('Committed new release');
	await execCommandAsPromise(`git tag v${newVersion}`);
	console.log('Created new tag');
	await execCommandAsPromise('git push');
	console.log('Pushed changes');
	await execCommandAsPromise('git push --tags');
	console.log('Pushed tags');
	const response = await updateFoundryRelease(false);
	if (!response.ok) {
		console.error('Failed to update Foundry release');
		console.error(await response.text());
		throw new Error('Failed to update Foundry release');
	}
	console.log('Updated Foundry release');
	console.log('✅ Build successful');
} catch (error) {
	console.error('❌ Build failed');
	console.error(error);
	process.exit(1);
}
