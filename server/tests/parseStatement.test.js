jest.mock('pdf-parse', () => {
  const getText = jest.fn()
  const destroy = jest.fn()
  const PDFParse = jest.fn().mockImplementation(() => ({
    getText,
    destroy,
  }))

  return {
    PDFParse,
    __mocks: {
      getText,
      destroy,
    },
  }
})

const pdfParse = require('pdf-parse')
const { parseStatementFile } = require('../src/utils/parseStatement')

describe('parseStatementFile', () => {
  it('parses pdf statements using the pdf parser', async () => {
    pdfParse.__mocks.getText.mockResolvedValue({
      text: `03/01/2026 Streaming Service 15.99\n03/02/2026 Service Charge 2.50\n03/12/2026 Coffee 4.99`,
    })

    const transactions = await parseStatementFile({
      originalname: 'statement.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('dummy-pdf-buffer'),
    })

    expect(pdfParse.PDFParse).toHaveBeenCalledTimes(1)
    expect(pdfParse.__mocks.getText).toHaveBeenCalledTimes(1)
    expect(pdfParse.__mocks.destroy).toHaveBeenCalledTimes(1)
    expect(transactions).toHaveLength(3)
    expect(transactions[0]).toMatchObject({
      description: 'Streaming Service',
      amount: -15.99,
    })
    expect(transactions[1]).toMatchObject({
      description: 'Service Charge',
      amount: -2.5,
    })
  })

  it('parses csv statements', async () => {
    const transactions = await parseStatementFile({
      originalname: 'statement.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2026-03-01,Streaming Service,-15.99\n2026-03-02,Service Charge,-2.50'),
    })

    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toMatchObject({
      description: 'Streaming Service',
      amount: -15.99,
    })
  })
})
