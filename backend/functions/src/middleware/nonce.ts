import type { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";

function ensureAdminInit() {
	try {
		if (!admin.apps.length) admin.initializeApp();
	} catch {
		/* noop */
	}
}

export function antiReplayNonce(ttlSeconds = 300, enabled = true) {
	ensureAdminInit();
	let db: FirebaseFirestore.Firestore | null = null;
	try {
		db = admin.firestore();
	} catch {
		db = null;
	}
	return async function (req: Request, res: Response, next: NextFunction) {
		if (!enabled) return next();
		if (!db) return next();
		const nonce = req.header("X-Nonce");
		if (!nonce) return res.status(401).json({ error: { code: "AUTH_FAILED", message: "nonce required" } });
		const key = `nonce:${nonce}`;
		const failOpen = process.env.ANTI_REPLAY_FAIL_OPEN !== "false"; // default true
		try {
			const ref = db.collection("nonces").doc(key);
			const snap = await ref.get();
			const now = Date.now();
			if (snap.exists) {
				const data = snap.data() as any;
				const expiresAt = Number(data?.expiresAt || 0);
				if (!expiresAt || now < expiresAt) {
					return res.status(401).json({ error: { code: "AUTH_FAILED", message: "replay detected" } });
				}
				// expired: overwrite to allow fresh request
			}
			await ref.set({ createdAt: now, expiresAt: now + ttlSeconds * 1000 });
			next();
		} catch {
			// fail-open on transient errors (configurable)
			if (failOpen) return next();
			return res.status(503).json({ error: { code: "NONCE_UNAVAILABLE", message: "anti-replay unavailable" } });
		}
	};
}
