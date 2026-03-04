async function call(email){
  const res = await fetch('https://assa-ac-duzn.onrender.com/api/auth/check-email',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email })
  });
  console.log('status', res.status);
  try {
    const json = await res.json();
    console.log('body JSON:', JSON.stringify(json));
  } catch (e) {
    const text = await res.text();
    console.log('body text:', text);
  }
}

call(process.argv[2]||'operateur12@gmail.com').catch(e=>{console.error(e);process.exit(1)});
