import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BinaryMetadataUtil, BinaryUtil, castTo } from '@travetto/runtime';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';
import { S3 } from '@aws-sdk/client-s3';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';

@Suite()
class S3BasicSuite extends ModelBasicSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3CrudSuite extends ModelCrudSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3ExpirySuite extends ModelExpirySuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3PolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3BlobSuite extends ModelBlobSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;

  @Test({ timeout: 15000 })
  async largeFile() {
    const service: S3ModelService = castTo(await this.service);
    const buffer = BinaryUtil.binaryArrayToBuffer(BinaryUtil.makeBinaryArray(1.5 * service.config.chunkSize));
    for (let i = 0; i < buffer.byteLength; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const hash = BinaryMetadataUtil.hash(buffer);

    await service.upsertBlob(hash, buffer, {
      filename: 'Random.bin',
      contentType: 'binary/octet-stream',
      size: buffer.byteLength,
      hash
    });

    const blob = await service.getBlob(hash);
    const resolved = await BinaryMetadataUtil.hash(blob);
    const blobBytes = await blob.bytes();
    assert(buffer.byteLength > 0);
    assert(blobBytes.byteLength > 0);
    assert(buffer.byteLength === blobBytes.byteLength, 'Size mismatch');
    assert(buffer.equals(blobBytes), 'Content mismatch');
    assert(resolved === hash);
  }

  @Test()
  async verifyBlobUrls() {
    // 1. Default publicBaseUrl
    const config = new S3ModelConfig();
    config.bucket = 'my-bucket';
    config.endpoint = ''; // Prevent default localhost endpoint during test
    await config.finalizeConfig();
    assert(config.publicBaseUrl === 'https://my-bucket.s3.amazonaws.com');

    // 2. Custom publicBaseUrl configuration with normalization
    const configCustom = new S3ModelConfig();
    configCustom.bucket = 'my-bucket';
    configCustom.publicBaseUrl = 'https://cdn.example.com';
    configCustom.endpoint = 'https://cdn.example.com';
    await configCustom.finalizeConfig();
    assert(configCustom.publicBaseUrl === 'https://cdn.example.com');

    // 4. publicBaseUrl derived from localhost endpoint directly
    const configLocalhost = new S3ModelConfig();
    configLocalhost.bucket = 'my-bucket';
    configLocalhost.endpoint = 'http://localhost:4566/some-path?param=1';
    await configLocalhost.finalizeConfig();
    assert(configLocalhost.publicBaseUrl === 'http://localhost:4566/some-path?param=1');

    // 5. getBlobReadUrl with false (returns public URL)
    const customService = new S3ModelService(configCustom);
    customService.client = new S3(configCustom.config);
    const customUrl = await customService.getBlobReadUrl('test-path/file.txt', false);
    assert(customUrl === 'https://cdn.example.com/test-path/file.txt');

    // 6. getBlobReadUrl with forcePathStyle and false
    const pathStyleConfig = new S3ModelConfig();
    pathStyleConfig.bucket = 'my-bucket';
    pathStyleConfig.endpoint = 'https://storage.googleapis.com';
    pathStyleConfig.publicBaseUrl = 'https://storage.googleapis.com';
    await pathStyleConfig.finalizeConfig();
    // Simulate setting forcePathStyle to true
    pathStyleConfig.config.forcePathStyle = true;

    const pathStyleService = new S3ModelService(pathStyleConfig);
    const pathStyleUrl = await pathStyleService.getBlobReadUrl('test-path/file.txt', false);
    assert(pathStyleUrl === 'https://storage.googleapis.com/my-bucket/test-path/file.txt');

    // 7. getBlobReadUrl with omitted/default (returns 1h signed URL)
    const readSignedUrl = await customService.getBlobReadUrl('test-path/file.txt');
    assert(readSignedUrl.includes('test-path/file.txt?'));
    assert(readSignedUrl.includes('X-Amz-Expires=3600'));
  }
}
