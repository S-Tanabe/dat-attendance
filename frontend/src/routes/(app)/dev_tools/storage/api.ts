import type Client from '$lib/generated/client'

export interface BucketCapabilities {
	read: boolean
	write: boolean
	destroy: boolean
	createPrefix: boolean
}

export interface StorageBucketSummary {
	id: string
	bucketName: string
	label: string
	description?: string
	defaultPrefix?: string
	capabilities: BucketCapabilities
}

export interface DirectoryEntry {
	key: string
	name: string
}

export interface ObjectEntry {
	key: string
	name: string
	size: number
	etag: string
	contentType?: string
}

export interface ListBucketsResponse {
	buckets: StorageBucketSummary[]
}

export interface ListObjectsRequest {
	bucketId: string
	prefix?: string
	limit?: number
}

export interface ListObjectsResponse {
	bucketId: string
	prefix: string
	directories: DirectoryEntry[]
	objects: ObjectEntry[]
}

export interface GenerateUrlRequest {
	bucketId: string
	key: string
	ttlSeconds?: number
	contentType?: string
}

export interface SignedUrlResponse {
	url: string
	expiresIn: number
}

export interface DeleteObjectsRequest {
	bucketId: string
	keys: string[]
}

export interface DeleteObjectsResponse {
	deleted: string[]
	failed: Array<{ key: string, error: string }>
}

export interface CreatePrefixRequest {
	bucketId: string
	prefix: string
}

export interface CreatePrefixResponse {
	key: string
}

export interface ObjectMetadataResponse {
	key: string
	size: number
	etag: string
	contentType?: string
	version?: string
}

interface DevToolsStorageAPI {
	list_available_buckets: () => Promise<ListBucketsResponse>
	list_objects: (payload: ListObjectsRequest) => Promise<ListObjectsResponse>
	generate_download_url: (payload: GenerateUrlRequest) => Promise<SignedUrlResponse>
	generate_upload_url: (payload: GenerateUrlRequest) => Promise<SignedUrlResponse>
	delete_objects: (payload: DeleteObjectsRequest) => Promise<DeleteObjectsResponse>
	create_prefix: (payload: CreatePrefixRequest) => Promise<CreatePrefixResponse>
	get_object_metadata: (payload: { bucketId: string, key: string }) => Promise<ObjectMetadataResponse>
}

function storageApi(client: Client): DevToolsStorageAPI {
	return client.dev_tools as unknown as DevToolsStorageAPI
}

export async function fetchBuckets(client: Client): Promise<StorageBucketSummary[]> {
	const api = storageApi(client)
	const { buckets } = await api.list_available_buckets()
	return buckets
}

export async function fetchObjects(client: Client, payload: ListObjectsRequest): Promise<ListObjectsResponse> {
	const api = storageApi(client)
	return api.list_objects(payload)
}

export async function requestDownloadUrl(client: Client, payload: GenerateUrlRequest): Promise<SignedUrlResponse> {
	const api = storageApi(client)
	return api.generate_download_url(payload)
}

export async function requestUploadUrl(client: Client, payload: GenerateUrlRequest): Promise<SignedUrlResponse> {
	const api = storageApi(client)
	return api.generate_upload_url(payload)
}

export async function deleteObjects(client: Client, payload: DeleteObjectsRequest): Promise<DeleteObjectsResponse> {
	const api = storageApi(client)
	return api.delete_objects(payload)
}

export async function createPrefix(client: Client, payload: CreatePrefixRequest): Promise<CreatePrefixResponse> {
	const api = storageApi(client)
	return api.create_prefix(payload)
}

export async function fetchMetadata(client: Client, payload: { bucketId: string, key: string }): Promise<ObjectMetadataResponse> {
	const api = storageApi(client)
	return api.get_object_metadata(payload)
}
