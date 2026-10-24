import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export function ModeratorAccept() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading"|"success"|"error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMsg("Missing token");
      return;
    }
    fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/admin/moderators/accept?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(data => {
        setStatus("success");
        setMsg(data.message || "Moderator activated");
        setTimeout(() => navigate("/admin/settings", { replace: true }), 1500);
      })
      .catch(e => {
        setStatus("error");
        setMsg(e.message || "Invalid or expired link");
      });
  }, [params, navigate]);

  return (
    <div style={{padding:40, textAlign:"center"}}>
      <h2>{status === "loading" ? "Activating..." : status === "success" ? "Success" : "Error"}</h2>
      <p>{msg}</p>
      {status !== "loading" && <p>Redirecting to Admin Settings...</p>}
    </div>
  );
}
