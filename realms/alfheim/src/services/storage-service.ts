/**
 * Storage Service - Alfheim
 * 
 * 
 * VULNERABLE: IAM misconfiguration allows unauthorized bucket access with any credentials
 */

export interface Bucket {
  name: string;
  public: boolean;
  objects: string[];
  owner?: string;
}

export interface StorageObject {
  key: string;
  content: string;
  contentType: string;
  acl: 'public-read' | 'private';
}

export interface Credentials {
  AccessKeyId: string;
  SecretAccessKey?: string;
  Token?: string;
}

export class StorageService {
  private buckets: Map<string, Bucket> = new Map();
  private objects: Map<string, StorageObject> = new Map();

  constructor(flag: string) {
    this.initializeStorage(flag);
  }

  private initializeStorage(flag: string): void {
    // User documents (public)
    this.buckets.set('user-documents', {
      name: 'user-documents',
      public: true,
      objects: ['doc1.txt', 'doc2.txt', 'readme.md'],
      owner: 'public',
    });

    this.objects.set('user-documents/doc1.txt', {
      key: 'doc1.txt',
      content: 'Sample user document 1',
      contentType: 'text/plain',
      acl: 'public-read',
    });

    this.objects.set('user-documents/doc2.txt', {
      key: 'doc2.txt',
      content: 'Sample user document 2',
      contentType: 'text/plain',
      acl: 'public-read',
    });

    this.objects.set('user-documents/readme.md', {
      key: 'readme.md',
      content: '# User Documents\n\nPublic storage for user files.',
      contentType: 'text/markdown',
      acl: 'public-read',
    });

    //
    this.buckets.set('alfheim-secrets', {
      name: 'alfheim-secrets',
      public: false,
      objects: ['admin-key.json', 'flag.txt', 'credentials.json'],
      owner: 'admin',
    });

    // 
    this.objects.set('alfheim-secrets/flag.txt', {
      key: 'flag.txt',
      content: flag,
      contentType: 'text/plain',
      acl: 'private',
    });

    this.objects.set('alfheim-secrets/admin-key.json', {
      key: 'admin-key.json',
      content: JSON.stringify({ adminKey: 'ALF-ADMIN-2025-GOLDEN', role: 'administrator' }, null, 2),
      contentType: 'application/json',
      acl: 'private',
    });

    this.objects.set('alfheim-secrets/credentials.json', {
      key: 'credentials.json',
      content: JSON.stringify({
        accessKey: 'AKIAIOSFODNN7EXAMPLE',
        secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'alfheim-north-1',
      }, null, 2),
      contentType: 'application/json',
      acl: 'private',
    });

    // System backups
    this.buckets.set('system-backups', {
      name: 'system-backups',
      public: false,
      objects: ['backup-2025.tar.gz'],
      owner: 'system',
    });

    this.objects.set('system-backups/backup-2025.tar.gz', {
      key: 'backup-2025.tar.gz',
      content: '[Binary backup data]',
      contentType: 'application/gzip',
      acl: 'private',
    });
  }

  /**
   * 
   */
  listBuckets(): Bucket[] {
    console.log(`[StorageService] Listing all buckets`);
    return Array.from(this.buckets.values());
  }

  /**
   * 
   */
  listObjects(bucketName: string, credentials?: Credentials): string[] | null {
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return null;
    }

    // 
    if (bucket.public) {
      console.log(`[StorageService] Listing objects in public bucket: ${bucketName}`);
      return bucket.objects;
    }

    //
    if (!credentials) {
      console.log(`[StorageService] Access denied: ${bucketName} is private`);
      return null;
    }

    // VULNERABLE: Any credentials grant access (no validation!)
    console.log(`[VULNERABLE] Listing objects in ${bucketName} with credentials: ${credentials.AccessKeyId}`);
    return bucket.objects;
  }

  /**
   * Gets object content
   * VULNERABLE: Private buckets accessible with any IMDS credentials
   */
  getObject(bucketName: string, key: string, credentials?: Credentials): StorageObject | null {
    const objectKey = `${bucketName}/${key}`;
    const obj = this.objects.get(objectKey);

    if (!obj) {
      return null;
    }

    // Public objects accessible without credentials
    if (obj.acl === 'public-read') {
      console.log(`[StorageService] Getting public object: ${objectKey}`);
      return obj;
    }

    // Private objects require credentials
    if (!credentials) {
      console.log(`[StorageService] Access denied: ${objectKey} is private`);
      return null;
    }

    // VULNERABLE: IAM misconfiguration - any valid-looking credentials grant access!
    // 
    //
    if (credentials.AccessKeyId && credentials.AccessKeyId.startsWith('AKIA')) {
      console.log(`[VULNERABLE] Granting access to ${objectKey} with credentials: ${credentials.AccessKeyId}`);
      return obj;
    }

    console.log(`[StorageService] Invalid credentials format`);
    return null;
  }

  /**
   * Check if bucket exists
   */
  bucketExists(bucketName: string): boolean {
    return this.buckets.has(bucketName);
  }
}
