/**
 * Culturally appropriate Indian-diaspora name lists.
 * Each background has first names (male/female) and surnames typical of that region.
 */

export interface NameBank {
  maleFirstNames: string[];
  femaleFirstNames: string[];
  surnames: string[];
}

export const NAME_BANKS: Record<string, NameBank> = {
  Gujarati: {
    maleFirstNames: ['Arjun', 'Dhruv', 'Karan', 'Mihir', 'Neel', 'Pranav', 'Raj', 'Rohan', 'Shivam', 'Vivek'],
    femaleFirstNames: ['Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Nidhi', 'Priya', 'Riya', 'Sejal', 'Tara'],
    surnames: ['Patel', 'Shah', 'Mehta', 'Desai', 'Modi', 'Trivedi', 'Joshi', 'Chokshi'],
  },
  Tamil: {
    maleFirstNames: ['Arun', 'Karthik', 'Kumar', 'Mahesh', 'Praveen', 'Rajan', 'Senthil', 'Surya', 'Vignesh', 'Vijay'],
    femaleFirstNames: ['Deepa', 'Gayathri', 'Keerthana', 'Lakshmi', 'Nithya', 'Preethi', 'Subha', 'Suganya', 'Vanitha', 'Yamuna'],
    surnames: ['Krishnan', 'Murugan', 'Natarajan', 'Pillai', 'Rajan', 'Srinivasan', 'Subramaniam', 'Venkataraman'],
  },
  Punjabi: {
    maleFirstNames: ['Amandeep', 'Gurpreet', 'Harjot', 'Jaspreet', 'Manpreet', 'Navdeep', 'Paramjit', 'Rajvir', 'Simran', 'Sukhdeep'],
    femaleFirstNames: ['Amanpreet', 'Gurjot', 'Harleen', 'Jasmeen', 'Mandeep', 'Navneet', 'Parveen', 'Simran', 'Sukhjeet', 'Tejinder'],
    surnames: ['Singh', 'Kaur', 'Dhaliwal', 'Grewal', 'Sandhu', 'Gill', 'Sidhu', 'Brar'],
  },
  Malayali: {
    maleFirstNames: ['Abin', 'Amal', 'Anand', 'Binu', 'Jijo', 'Mathew', 'Nithin', 'Rahul', 'Sachin', 'Vishnu'],
    femaleFirstNames: ['Akhila', 'Ancy', 'Athira', 'Bindu', 'Divya', 'Geethu', 'Lekha', 'Nimisha', 'Reshma', 'Sneha'],
    surnames: ['Nair', 'Menon', 'Pillai', 'Varma', 'Thomas', 'George', 'Mathew', 'Joseph'],
  },
  Bengali: {
    maleFirstNames: ['Abhishek', 'Arnab', 'Debashish', 'Indranil', 'Partha', 'Pritam', 'Sayan', 'Soumya', 'Subhajit', 'Sudipta'],
    femaleFirstNames: ['Ankita', 'Chandrani', 'Debasmita', 'Indrani', 'Mou', 'Priyanka', 'Sayani', 'Shreya', 'Subhashini', 'Tania'],
    surnames: ['Banerjee', 'Chakraborty', 'Das', 'Ghosh', 'Mukherjee', 'Roy', 'Sen', 'Bose'],
  },
  Marathi: {
    maleFirstNames: ['Amol', 'Ganesh', 'Nikhil', 'Omkar', 'Prasad', 'Rahul', 'Rohit', 'Sachin', 'Sanket', 'Tushar'],
    femaleFirstNames: ['Aparna', 'Gauri', 'Kavita', 'Madhuri', 'Neha', 'Pallavi', 'Prachi', 'Rucha', 'Swati', 'Vrushali'],
    surnames: ['Kulkarni', 'Deshmukh', 'Patil', 'Deshpande', 'Joshi', 'Pawar', 'Kale', 'More'],
  },
  Telugu: {
    maleFirstNames: ['Aditya', 'Bhanu', 'Charan', 'Hemanth', 'Naveen', 'Pramod', 'Ravi', 'Srinath', 'Uday', 'Vijay'],
    femaleFirstNames: ['Bhavana', 'Chandu', 'Divya', 'Haritha', 'Madhavi', 'Padma', 'Ramya', 'Sahithi', 'Tejaswini', 'Vani'],
    surnames: ['Reddy', 'Sharma', 'Rao', 'Naidu', 'Varma', 'Chowdary', 'Prasad', 'Kumar'],
  },
  Rajasthani: {
    maleFirstNames: ['Ajay', 'Bharat', 'Dinesh', 'Gopal', 'Hemant', 'Lokesh', 'Mahaveer', 'Ramesh', 'Suresh', 'Vikram'],
    femaleFirstNames: ['Aarti', 'Bharti', 'Geeta', 'Kiran', 'Meena', 'Pooja', 'Rekha', 'Sangeeta', 'Shobha', 'Usha'],
    surnames: ['Sharma', 'Gupta', 'Agarwal', 'Singhania', 'Birla', 'Tiwari', 'Dixit', 'Mathur'],
  },
  Kannadiga: {
    maleFirstNames: ['Adarsh', 'Darshan', 'Harish', 'Kiran', 'Naveen', 'Pradeep', 'Rakesh', 'Suresh', 'Tejas', 'Vinay'],
    femaleFirstNames: ['Akshata', 'Bindhu', 'Divya', 'Kavitha', 'Megha', 'Namitha', 'Pavithra', 'Rekha', 'Shruthi', 'Vidya'],
    surnames: ['Gowda', 'Hegde', 'Nayak', 'Rao', 'Shetty', 'Kumar', 'Reddy', 'Murthy'],
  },
  Hyderabadi: {
    maleFirstNames: ['Amjad', 'Farhan', 'Irfan', 'Junaid', 'Khalid', 'Mohammed', 'Naveed', 'Salman', 'Tariq', 'Zubair'],
    femaleFirstNames: ['Afreen', 'Aisha', 'Bushra', 'Fareeda', 'Humera', 'Nazma', 'Rukhsar', 'Samreen', 'Tabassum', 'Zara'],
    surnames: ['Khan', 'Siddiqui', 'Hussain', 'Mirza', 'Ali', 'Ahmed', 'Ansari', 'Baig'],
  },
  Goan: {
    maleFirstNames: ['Aaron', 'Brian', 'Carlos', 'Derek', 'Felix', 'Glen', 'Ivan', 'Jason', 'Kevin', 'Liam'],
    femaleFirstNames: ['Alicia', 'Bianca', 'Celine', 'Diana', 'Fiona', 'Grace', 'Isabel', 'Jessica', 'Karen', 'Leah'],
    surnames: ['Fernandes', 'D\'Souza', 'Pereira', 'Rodrigues', 'Gomes', 'Dias', 'Costa', 'Pinto'],
  },
  'Anglo-Indian': {
    maleFirstNames: ['Alan', 'Bernard', 'Charles', 'David', 'Edward', 'Frank', 'George', 'Henry', 'Ian', 'James'],
    femaleFirstNames: ['Angela', 'Betty', 'Carol', 'Dorothy', 'Elizabeth', 'Florence', 'Gloria', 'Helen', 'Iris', 'Joyce'],
    surnames: ['D\'Souza', 'Fernandez', 'Pereira', 'Williams', 'Thomas', 'Johnson', 'Brown', 'Smith'],
  },
};

export const ALL_CULTURAL_BACKGROUNDS = Object.keys(NAME_BANKS);

export function randomName(
  culturalBackground: string,
  gender: 'male' | 'female',
): { firstName: string; lastName: string } {
  const bank = NAME_BANKS[culturalBackground] ?? NAME_BANKS['Gujarati']!;
  const firstNames = gender === 'male' ? bank.maleFirstNames : bank.femaleFirstNames;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]!;
  const lastName = bank.surnames[Math.floor(Math.random() * bank.surnames.length)]!;
  return { firstName, lastName };
}
