import { Stripe } from 'stripe';
import { CustomerPurchase } from '../../shared/types';
import { ApplePurchase } from './types';

export interface Env {
	DB: D1Database;
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SIGNING_SECRET: string;
	REVENUECAT_WEBHOOK_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (path === '/') {
			return handleStripeWebhook(request, env);
		} else if (path === '/apple') {
			return handleApplePurchase(request, env);
		} else {
			return new Response('not found', { status: 404 });
		}
	}
};

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
	// Verify event came from Stripe
	const stripe = new Stripe(env.STRIPE_SECRET_KEY);
	let event: Stripe.CheckoutSessionCompletedEvent;
	try {
		event = (await stripe.webhooks.constructEventAsync(
			await request.text(),
			request.headers.get('Stripe-Signature') as string,
			env.STRIPE_WEBHOOK_SIGNING_SECRET
		)) as Stripe.CheckoutSessionCompletedEvent;
	} catch (err) {
		console.error(err);
		return new Response('invalid signature', { status: 400 });
	}

	// Log event for debugging
	console.log('event', event);

	// Verify event has necessary data
	const appId = event.data.object.metadata?.app_id;
	if (!appId) {
		return new Response('no app id', { status: 200 });
	}
	if (event.type !== 'checkout.session.completed') {
		return new Response('not checkout session succeeded', { status: 200 });
	}
	if (event.data.object.payment_status !== 'paid') {
		return new Response('payment not paid', { status: 200 });
	}
	if (!event.data.object.customer_details?.email) {
		return new Response('no customer email', { status: 200 });
	}

	// Record purchase
	await recordUserPurchase(env, event.data.object.customer_details.email, appId);

	// Return success
	return new Response('purchase successful', { status: 200 });
}

async function handleApplePurchase(request: Request, env: Env): Promise<Response> {
	// verify request body
	const body: ApplePurchase = await request.json();
	if (!body.user_email) return new Response('no user email', { status: 400 });
	if (!body.app_id) return new Response('no app id', { status: 400 });

	// record purchase
	await recordUserPurchase(env, body.user_email, body.app_id);

	// return success
	return new Response('recorded purchase', { status: 200 });
}

async function recordUserPurchase(env: Env, userEmail: string, appId: string): Promise<void> {
	const purchaseRecord: CustomerPurchase = {
		user_email: userEmail,
		app_id: appId,
		purchased: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
	await env.DB.prepare('INSERT INTO CustomerPurchases (user_email, app_id, purchased, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
		.bind(purchaseRecord.user_email, purchaseRecord.app_id, purchaseRecord.purchased, purchaseRecord.created_at, purchaseRecord.updated_at)
		.run();
}
