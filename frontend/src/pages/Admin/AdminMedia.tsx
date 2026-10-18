import { useCallback, useEffect, useState } from "react";
import { deleteMediaAsset, fetchMediaAssets, uploadMediaFile, type MediaAssetRecord } from "../../lib/adminApi";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminMedia() {
  const [assets, setAssets] = useState<MediaAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await fetchMediaAssets();
    if (result) {
      setAssets(result);
      setError("");
    } else {
      setError("Media library unavailable. Configure S3 media storage and check the API connection.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchMediaAssets().then((result) => {
      if (cancelled) return;
      if (result) setAssets(result);
      else setError("Media library unavailable. Configure S3 media storage and check the API connection.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const onFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    let uploaded = 0;
    for (const file of Array.from(files)) {
      const asset = await uploadMediaFile(file);
      if (asset) {
        setAssets((current) => [asset, ...current]);
        uploaded += 1;
      }
    }
    setUploading(false);
    if (uploaded) setMessage(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded to S3 and saved in the media library.`);
    if (uploaded !== files.length) setError("Some files could not be uploaded. Check S3 configuration, file type, size, and bucket CORS.");
  };

  const remove = async (asset: MediaAssetRecord) => {
    if (!window.confirm(`Permanently delete ${asset.filename} from S3?`)) return;
    if (!(await deleteMediaAsset(asset.id))) {
      setError("Could not delete this S3 object.");
      return;
    }
    setAssets((current) => current.filter((item) => item.id !== asset.id));
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div><div className="eyebrow">Private object storage</div><h1>Media library</h1><p>Files upload directly to S3. Metadata and post references remain in PostgreSQL.</p></div>
        <button className="button-secondary" type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading}>Refresh</button>
        <label className="admin-primary media-upload-button">{uploading ? "Uploading..." : "+ Upload files"}<input type="file" accept="image/*,video/*,audio/*,application/pdf" multiple disabled={uploading} onChange={(event) => { void onFilesSelected(event.target.files); event.currentTarget.value = ""; }} /></label>
      </div>
      {message && <p className="review-success" role="status">{message}</p>}
      {error && <p className="review-error" role="alert">{error}</p>}
      <div className="admin-panel section-panel media-library-panel">
        {loading ? <p className="audit-message" role="status">Loading S3 media...</p> : assets.length === 0 ? <p className="audit-message">No uploaded assets yet. Configure a private S3 media bucket, then upload files here.</p> : (
          <div className="media-grid">
            {assets.map((asset) => <article className="media-asset" key={asset.id}>
              <a className="media-preview media-preview-live" href={asset.url} target="_blank" rel="noreferrer" aria-label={`Open ${asset.filename}`}>
                {asset.mimeType.startsWith("image/") ? <img src={asset.url} alt={asset.altText ?? asset.filename} loading="lazy" /> : <span aria-hidden="true">{asset.mimeType.startsWith("video/") ? "▶" : asset.mimeType.startsWith("audio/") ? "♫" : "PDF"}</span>}
              </a>
              <div className="media-asset-meta"><strong title={asset.filename}>{asset.filename}</strong><small>{asset.mimeType} · {formatSize(asset.sizeBytes)}</small><button className="button-secondary" type="button" onClick={() => void remove(asset)}>Delete from S3</button></div>
            </article>)}
          </div>
        )}
      </div>
      <p className="field-help">Uploads are private by default. Only images attached to published posts can be served to public readers.</p>
    </section>
  );
}
