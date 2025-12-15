import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function inspect() {
    const { data, error } = await supabase.from('minions').select('*').limit(1);
    if (error) {
        console.error('Error fetching minions:', error);
    } else {
        if (data.length > 0) {
            console.log('Minions columns:', Object.keys(data[0]));
            console.log('Sample Data:', data[0]);
        } else {
            console.log('Table minions exists but is empty.');
        }
    }
}

inspect();
