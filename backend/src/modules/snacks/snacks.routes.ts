import { Router } from 'express';
import { pool } from '../../db/pool.js';

export const snacksRouter = Router();

// The food & beverage menu offered at checkout.
snacksRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, category, price_paise AS "pricePaise", is_veg AS "isVeg", icon
       FROM snacks WHERE available
      ORDER BY array_position(ARRAY['combos', 'popcorn', 'snacks', 'beverages'], category), price_paise`,
  );
  res.json({ snacks: rows });
});
