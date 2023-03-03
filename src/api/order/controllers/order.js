'use strict';

/**
 * order controller
 */

const stripe = require('stripe')(process.env.STRIPE_KEY);

const { createCoreController } = require('@strapi/strapi').factories;

// this coreController handles our CRUD operations
module.exports = createCoreController('api::order.order', ({ strapi }) => ({ // we made this function, so it gets called whenever we make a request
    async create(ctx) { // async function because we are adding new data to DB
        const { products } = ctx.request.body; // we removed the email field --- we are taking the user info first
        // items from front-end

        try {
        const lineItems = await Promise.all(
            products.map(async (product) => {
                const item =  await strapi
                .service("api::product.product")
                .findOne(product.id); //using the product and it's "id", we are gonna find out item
                // we are searching for(that front-end product) it in our backend "DB"

                return {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: item.title,
                        },
                        unit_amount: Math.round(item.price * 100) //by default STRIPE uses cents, so multiply by 100
                    },
                    quantity: product.quantity,
                }

            })
        )
        
            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                success_url: process.env.CLIENT_URL+"?success=true",
                cancel_url: process.env.CLIENT_URL+"?success=false",
                // success_url: `${process.env.CLIENT_URL} + ?success=true`,
                // cancel_url: `${process.env.CLIENT_URL}?success=false`,
                line_items: lineItems,
                shipping_address_collection: { allowed_countries: ["US", "CA"]},
                payment_method_types: ["card"],
            });

            // finally we can write this information to our database
            await strapi
            .service("api::order.order")
            .create({  data: { products, stripeId: session.id },
            });

            return { stripeSession: session }; //we are sending this too the frontend using it's id
        }
        catch (error) {
            ctx.response.status = 500;
            return error;
        }
    }
}));
