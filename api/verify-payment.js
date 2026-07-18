import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference, email, plan, amount } = req.body;

  if (!reference || !email || !plan || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    if (paystackData.data.amount !== amount * 100) {
      return res.status(400).json({ error: 'Amount mismatch detected' });
    }

    const token = crypto.randomUUID();

    await supabase.from('payments').insert({
      email, plan, amount, reference, status: 'success'
    });

    await supabase.from('qr_tokens').insert({ token });

    return res.status(200).json({ 
      success: true, 
      token,
      plan,
      message: 'Payment verified successfully!'
    });

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
