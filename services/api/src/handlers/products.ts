import { PRODUCTS } from '@payinparts/core';
import { httpHandler, ok } from '../http';

export const handler = httpHandler(async () => ok({ products: PRODUCTS }));
