export type RevenueCatWebhookPurchaseMessage = {
	event:       RevenueCatEvent;
	api_version: string;
}

export type RevenueCatEvent = {
	event_timestamp_ms:          number;
	product_id:                  string;
	period_type:                 string;
	purchased_at_ms:             number;
	expiration_at_ms:            number;
	environment:                 string;
	entitlement_id:              number | null;
	entitlement_ids:             string[];
	presented_offering_id:       number | null;
	transaction_id:              string;
	original_transaction_id:     string;
	is_family_share:             boolean;
	country_code:                string;
	app_user_id:                 string;
	aliases:                     string[];
	original_app_user_id:        string;
	currency:                    string;
	price:                       number;
	price_in_purchased_currency: number;
	subscriber_attributes:       {
		$email: {
			updated_at_ms: number;
			value:         string;
		};
	};
	store:                       string;
	takehome_percentage:         number;
	offer_code:                  number | null;
	type:                        string;
	id:                          string;
	app_id:                      string;
}
