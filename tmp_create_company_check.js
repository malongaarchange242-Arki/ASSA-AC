(async () => {
  const loginRes = await fetch('http://localhost:5002/api/admins/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'malongadrich@gmail.com', password: '12345678' })
  });
  const loginData = await loginRes.json();
  console.log('LOGIN', loginRes.status, loginData.message);

  const createRes = await fetch('http://localhost:5002/api/admins/create-company', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + loginData.jwtTokenAdmin,
      'x-access-token': loginData.jwtTokenAdmin
    },
    body: JSON.stringify({
      company_name: 'Compagnie Demo',
      representative_name: 'Jean Dupont',
      email: 'demo.cie.local@gmail.com',
      phone_number: '0501010101',
      full_address: 'Libreville',
      country: 'Gabon',
      city: 'Libreville',
      airport_code: 'LBV'
    })
  });

  const text = await createRes.text();
  console.log('CREATE_STATUS', createRes.status);
  console.log(text);
})();
