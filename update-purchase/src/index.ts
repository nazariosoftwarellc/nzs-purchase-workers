import { Stripe } from 'stripe';

export interface Env {
	DB: D1Database;
}

type CustomerPurchase = {
	user_email: string;
	app_id: string;
	purchased: boolean;
	created_at: string;
	updated_at: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const purchaseEvent: Stripe.PaymentIntentSucceededEvent = await request.json();
		if (purchaseEvent.type !== 'payment_intent.succeeded') {
			return new Response('not payment intent succeeded', { status: 200 });
		}
		if (!purchaseEvent.data.object.receipt_email) {
			return new Response('no receipt email', { status: 200 });
		}
		const purchaseRecord: CustomerPurchase = {
			user_email: purchaseEvent.data.object.receipt_email,
			app_id: purchaseEvent.data.object.metadata.app_id,
			purchased: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		await env.DB.prepare('INSERT INTO CustomerPurchases (user_email, app_id, purchased, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
			.bind(
				purchaseRecord.user_email,
				purchaseRecord.app_id,
				purchaseRecord.purchased,
				purchaseRecord.created_at,
				purchaseRecord.updated_at
			)
			.run();
		return new Response('purchase successful', { status: 200 });
	},
};
