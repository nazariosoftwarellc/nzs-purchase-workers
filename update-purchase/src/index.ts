import { Stripe } from 'stripe';
import { CustomerPurchase } from '../../shared/types';
import { RevenueCatWebhookPurchaseMessage } from './types';

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
			return handleStripeWebhook(request, env, ctx);
		} else if (path === '/revenuecat') {
			return handleRevenueCatWebhook(request, env, ctx);
		} else {
			return new Response('not found', { status: 404 });
		}
	}
};

async function handleRevenueCatWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	// Verify event came from RevenueCat
	const message: RevenueCatWebhookPurchaseMessage = await request.json();
	const authorizationKey = request.headers.get('Authorization');

	// Log event for debugging
	console.log('message', message);

	if (authorizationKey !== env.REVENUECAT_WEBHOOK_SECRET) {
		return new Response('invalid authorization', { status: 400 });
	}

	// get bundle id from app id
	const bundleId = bundleIdForRCAppId(message.event.app_id);
	if (!bundleId) {
		return new Response('no matching bundle id for ' + message.event.app_id, { status: 400 });
	}

	const event = message.event;
	if (!event.app_user_id) {
		return new Response('no email', { status: 400 });
	}

	// Record purchase
	const purchaseRecord: CustomerPurchase = {
		user_email: event.app_user_id,
		app_id: bundleId,
		purchased: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
	await env.DB.prepare('INSERT INTO CustomerPurchases (user_email, app_id, purchased, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
		.bind(purchaseRecord.user_email, purchaseRecord.app_id, purchaseRecord.purchased, purchaseRecord.created_at, purchaseRecord.updated_at)
		.run();

	// Return success
	return new Response('purchase successful', { status: 200 });
}

async function handleStripeWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
	const purchaseRecord: CustomerPurchase = {
		user_email: event.data.object.customer_details.email,
		app_id: appId,
		purchased: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
	await env.DB.prepare('INSERT INTO CustomerPurchases (user_email, app_id, purchased, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
		.bind(purchaseRecord.user_email, purchaseRecord.app_id, purchaseRecord.purchased, purchaseRecord.created_at, purchaseRecord.updated_at)
		.run();

	// Return success
	return new Response('purchase successful', { status: 200 });
}

function bundleIdForRCAppId(appId: string): string | undefined {
	const appIds: Record<string, string> = {
		'app92a7671793': 'com.nazariosoftware.Replies-for-Hacker-News',
	}
	return appIds[appId];;
}
