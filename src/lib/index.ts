import packageJsonRaw from '../../package.json?raw';
const packageJson = JSON.parse(packageJsonRaw);

export const manifest = {
  name: packageJson.name,
  description: packageJson.description,
  version: packageJson.version,
  author: packageJson.author,
  license: packageJson.license,
};
