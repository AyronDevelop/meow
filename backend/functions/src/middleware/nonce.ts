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
		try {
			const ref = db.collection("nonces").doc(key);
			const snap = await ref.get();
			if (snap.exists) return res.status(401).json({ error: { code: "AUTH_FAILED", message: "replay detected" } });
			await ref.set({ createdAt: Date.now(), expiresAt: Date.now() + ttlSeconds * 1000 });
			next();
		} catch {
			// fail-open on transient errors
			next();
		}
	};
}
