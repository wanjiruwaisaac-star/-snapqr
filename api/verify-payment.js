import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting - basic protection
  const { reference, email, plan, amount } = req.body;

  // Validate inputs
  if (!reference || !email || !plan || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Verify payment with Paystack server-side
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackRes.json();

    // Check payment was successful
    if (!paystackData.status || paystackData.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Check amount matches
    if (paystackData.data.amount !== amount * 100) {
      return res.status(400).json({ error: 'Amount mismatch detected' });
    }

    // Generate secure token
    const token = crypto.randomUUID();

    // Save payment to database
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        email,
        plan,
        amount,
        reference,
        status: 'success'
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Save token to database
    await supabase
      .from('qr_tokens')
      .insert({ token });

    // Return secure token to frontend
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
