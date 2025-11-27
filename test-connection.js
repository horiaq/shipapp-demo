const soap = require('soap');

async function testConnection() {
  console.log('Testing Geniki API connection...\n');
  
  const url = 'https://testvoucher.taxydromiki.gr/JobServicesV2.asmx?WSDL';
  
  try {
    const client = await soap.createClientAsync(url);
    console.log('✓ Connected to WSDL');
    
    const result = await client.AuthenticateAsync({
      sUsrName: 'clotest',
      sUsrPwd: '700149@',
      applicationKey: 'D8E50F4B-E372-4CFC-8330-EEF2B8D6D478'
    });
    
    const authResult = result[0].AuthenticateResult;
    
    if (authResult.Result === 0) {
      console.log('✓ Authentication successful');
      console.log('✓ Auth Key:', authResult.Key);
      console.log('\n✅ Connection test passed!\n');
    } else {
      console.error('✗ Authentication failed with code:', authResult.Result);
    }
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  }
}

testConnection();