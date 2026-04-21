const crypto = require('crypto');
const https = require('https');

const customer = 'C91AE7DEC6A7A2BD379F5039D6B6E0ED';
const key = 'oLKhzaJX8859';
const param = JSON.stringify({com: 'shunfeng', num: 'SF0221213153316', phone: ''});
const sign = crypto.createHash('md5').update(param + key + customer).digest('hex').toUpperCase();

const postData = 'customer=' + customer + '&sign=' + sign + '&param=' + encodeURIComponent(param);

console.log('查询: SF0221213153316');
console.log('请求参数:', param);

const options = {
  hostname: 'poll.kuaidi100.com',
  path: '/poll/query.do',
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'}
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log('\n响应:', JSON.stringify(result, null, 2));
    if (result.returnCode === '408') {
      console.log('\n⚠️ 需要手机号后4位才能查询顺丰快递');
    }
  });
});
req.on('error', e => console.error('错误:', e));
req.write(postData);
req.end();
