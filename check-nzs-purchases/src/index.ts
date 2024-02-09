import { CustomerPurchase } from '../../shared/types';

export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { searchParams } = new URL(request.url);
		const email = searchParams.get('email');
		const appId = searchParams.get('app');
		const customerPurchase = await env.DB.prepare(
			'SELECT * FROM CustomerPurchases WHERE user_email = ? AND app_id = ?'
		).bind(email, appId).first() as CustomerPurchase | null;
		return new Response(JSON.stringify(customerPurchase));
	},
};
