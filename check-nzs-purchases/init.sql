DROP TABLE IF EXISTS CustomerPurchases;
CREATE TABLE IF NOT EXISTS CustomerPurchases (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  user_email TEXT NOT NULL,
		app_id TEXT NOT NULL,
		purchased BOOLEAN NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
);
INSERT INTO CustomerPurchases (user_email, app_id, purchased, created_at, updated_at) VALUES ('kylebnazario@gmail.com', 'com.kylenazario.mute-chat', 1, '2024-01-29', '2024-01-29');
