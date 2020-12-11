import { ResourceManager } from '../../../src/resource';

/**
 * Find a single image, first one wins by resource path order
 */
export async function findSingleImage() {
  const imagePath = await ResourceManager.find('/images/asset.gif');
  return imagePath;
}

/**
 * Find all .gif files under the imsages folder
 */
export async function findAllImages() {
  const imagePaths = await ResourceManager.findAll(/[.]gif$/, 'images/');
  return imagePaths;
}
