import { Stripe } from 'stripe';

export interface Env {
	DB: D1Database;
}

type CustomerPurchase = {
	user_email: string;
	app_id: string;
	purchased: 0 | 1;
	created_at: string;
	updated_at: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const purchaseEvent: Stripe.CheckoutSessionCompletedEvent = await request.json();
		console.log('purchaseEvent', JSON.stringify(purchaseEvent));
		const appId = purchaseEvent.data.object.metadata?.app_id;
		if (!appId) {
			return new Response('no app id', { status: 200 });
		}
		if (purchaseEvent.type !== 'checkout.session.completed') {
			return new Response('not payment intent succeeded', { status: 200 });
		}
		if (purchaseEvent.data.object.payment_status !== 'paid') {
			return new Response('payment not paid', { status: 200 });
		}
		if (!purchaseEvent.data.object.customer_details?.email) {
			return new Response('no customer email', { status: 200 });
		}
		const purchaseRecord: CustomerPurchase = {
			user_email: purchaseEvent.data.object.customer_details.email,
			app_id: appId,
			purchased: 1,
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
