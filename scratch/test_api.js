const axios = require('axios');

async function testAdmission() {
    try {
        const response = await axios.post('http://localhost:5000/api/admissions', {
            name: "John Doe",
            course: "Full Stack Development",
            phone: "9876543210",
            email: "john_test_adm@example.com",
            password: "password123"
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testAdmission();
